import * as fs from 'fs'
import { SAXParser } from 'sax'
import { IDictDoneCb, SAXStream } from '../../dict-primitive'
import { FixDefinitions } from '../../definition'
import { FieldDefinitionParser } from './field-definition-parser'
import { FieldSetParser } from './field-set-parser'
import { MessageParser } from './message-parser'
import { NodeParser } from './node-parser'
import { FixParser } from '../../fix-parser'
import { GetJsFixLogger } from '../../../config'
import { promisify } from 'util'
import { ContainedComponentField } from '../../contained'
import { ISaxNode } from '../../sax-node'
import { FixDefinitionSource } from '../../fix-definition-source'
import { VersionUtil } from '../../version-util'
import { ParseState } from './parse-state'

export class QuickFixXmlFileParser extends FixParser {
  public parseState: ParseState = ParseState.Begin
  public numberPasses: number = 0
  public definitions: FixDefinitions
  private readonly singlePass = promisify(QuickFixXmlFileParser.subscribe)

  constructor (public readonly xmlPath: string, public getLogger: GetJsFixLogger) {
    super()
  }

  private static subscribe (instance: QuickFixXmlFileParser, saxStream: SAXStream, done: IDictDoneCb): void {
    let parser: NodeParser | null

    instance.numberPasses++
    switch (instance.parseState) {
      case ParseState.Begin: {
        instance.parseState = ParseState.FieldDefinitions
        break
      }
      case ParseState.FieldDefinitions: {
        instance.parseState = ParseState.Components
        break
      }
      case ParseState.Components: {
        if (instance.numberPasses > 4) {
          instance.parseState = ParseState.Messages
        }
        break
      }
    }

    const saxParser: SAXParser = saxStream._parser

    saxStream.on('error', (e: Error) => {
      done(e, null)
    })

    saxStream.on('closetag', (name) => {
      if (parser != null) {
        parser.close(saxParser.line, name)
      }
      switch (name) {
        case 'repository':
        case 'messages':
        case 'components':
        case 'header':
        case 'trailer': {
          parser = null
          break
        }
      }
    })

    saxStream.on('opentag', (node) => {
      const saxNode: ISaxNode = node as ISaxNode

      switch (saxNode.name) {
        case 'fix': {
          switch (instance.parseState) {
            case ParseState.FieldDefinitions: {
              const major = saxNode.attributes.major
              const minor = saxNode.attributes.major
              const description: string = `FIX.${major}.${minor}`
              instance.definitions = new FixDefinitions(FixDefinitionSource.QuickFix, VersionUtil.resolve(description))
              break
            }
          }
          break
        }

        case 'fields': {
          switch (instance.parseState) {
            case ParseState.FieldDefinitions: {
              parser = new FieldDefinitionParser(instance.definitions, instance.numberPasses)
              break
            }
            default: {
              parser = null
            }
          }
          break
        }

        case 'messages': {
          switch (instance.parseState) {
            case ParseState.Messages: {
              parser = new MessageParser(instance.definitions, instance.numberPasses)
              break
            }

            default:
              break
          }
          break
        }

        case 'components': {
          // can have a group containing components which contain themselves components of groups
          // each step will build forward references to a deeper level to ensure final messages
          // have all dependencies correctly defined.
          switch (instance.parseState) {
            case ParseState.Components:
              parser = new FieldSetParser(instance.definitions, instance.numberPasses)
              break
          }
          break
        }

        case 'field':
        case 'value':
        case 'component':
        case 'group': {
          if (parser != null) {
            parser.open(saxParser.line, saxNode)
          }
          break
        }

        case 'message': {
          switch (instance.parseState) {
            case ParseState.Messages: {
              if (parser != null) {
                parser.open(saxParser.line, saxNode)
              }
              break
            }

            default:
              break
          }
          break
        }

        case 'header':
        case 'trailer': {
          switch (instance.parseState) {
            case ParseState.Messages: {
              parser = new FieldSetParser(instance.definitions, instance.numberPasses)
              parser.open(saxParser.line, node)
              break
            }
          }
          break
        }
      }
    })

    saxStream.on('ready', () => {
      if (done) {
        parser = null
        done(undefined, instance.definitions)
      }
    })
  }

  private encloseMessages (): void {
    const messages = this.definitions.message
    const keys = messages.keys()
    const trailerName = 'StandardTrailer'
    keys.forEach(k => {
      const message = messages.get(k)
      const trailer = this.definitions.component.get(trailerName)
      if (trailer && !message?.components.containsKey(trailerName)) {
        const contained = new ContainedComponentField(trailer, message?.fields?.length ?? 0, true)
        message?.add(contained)
      }
    })
  }

  public async parse (): Promise<FixDefinitions> {
    return await new Promise<FixDefinitions>(async (resolve, reject) => {
      try {
        await this.onePass() // first fetch all field definitions
        await this.onePass() // first pass of components, will not know about forward components.
        await this.onePass() // second pass of components top level with forward references replace
        await this.onePass() // third pass of components all fully resolved i.e. pick up versions from pass above
        await this.onePass() // lastly messages with all dependencies
        this.encloseMessages()
        resolve(this.definitions)
      } catch (e) {
        reject(e)
      }
    })
  }

  private async onePass (): Promise<FixDefinitions | undefined | null> {
    const pass: fs.ReadStream = fs.createReadStream(this.xmlPath)
    const saxStream: SAXStream = require('sax').createStream(true, {})
    pass.pipe(saxStream)
    return await this.singlePass(this, saxStream)
  }
}
