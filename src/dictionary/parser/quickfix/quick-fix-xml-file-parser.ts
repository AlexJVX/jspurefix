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
import { ParseProgress } from './parse-progress'

export class QuickFixXmlFileParser extends FixParser {
  private readonly singlePass = promisify(QuickFixXmlFileParser.subscribe)
  private readonly state: ParseProgress = new ParseProgress()

  constructor (public readonly xmlPath: string, public getLogger: GetJsFixLogger) {
    super()
  }

  private static subscribe (progress: ParseProgress, saxStream: SAXStream, done: IDictDoneCb): void {
    let parser: NodeParser | null
    progress.next()
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
          switch (progress.parseState) {
            case ParseState.FieldDefinitions: {
              const major = saxNode.attributes.major
              const minor = saxNode.attributes.major
              const description: string = `FIX.${major}.${minor}`
              progress.definitions = new FixDefinitions(FixDefinitionSource.QuickFix, VersionUtil.resolve(description))
              break
            }
          }
          break
        }

        case 'fields': {
          switch (progress.parseState) {
            case ParseState.FieldDefinitions: {
              parser = new FieldDefinitionParser(progress)
              break
            }
            default: {
              parser = null
            }
          }
          break
        }

        case 'messages': {
          switch (progress.parseState) {
            case ParseState.Messages: {
              parser = new MessageParser(progress)
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
          switch (progress.parseState) {
            case ParseState.Components:
              parser = new FieldSetParser(progress)
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
          switch (progress.parseState) {
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
          switch (progress.parseState) {
            case ParseState.Messages: {
              parser = new FieldSetParser(progress)
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
        done(undefined, progress.definitions)
      }
    })
  }

  private encloseMessages (): void {
    const messages = this.state.definitions.message
    const keys = messages.keys()
    const trailerName = 'StandardTrailer'
    keys.forEach(k => {
      const message = messages.get(k)
      const trailer = this.state.definitions.component.get(trailerName)
      if (trailer && !message?.components.containsKey(trailerName)) {
        const contained = new ContainedComponentField(trailer, message?.fields?.length ?? 0, true)
        message?.add(contained)
      }
    })
  }

  public async parse (): Promise<FixDefinitions> {
    return await new Promise<FixDefinitions>(async (resolve, reject) => {
      try {
        while (this.state.parseState !== ParseState.End) {
          await this.onePass()
        }
        this.encloseMessages()
        resolve(this.state.definitions)
      } catch (e) {
        reject(e)
      }
    })
  }

  private async onePass (): Promise<FixDefinitions | undefined | null> {
    const pass: fs.ReadStream = fs.createReadStream(this.xmlPath)
    const saxStream: SAXStream = require('sax').createStream(true, {})
    pass.pipe(saxStream)
    return await this.singlePass(this.state, saxStream)
  }
}
