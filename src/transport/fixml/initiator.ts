import { IJsFixConfig } from '../../config/js-fix-config'
import { MsgTransport } from '../msg-transport'
import { MakeFixmlSession } from './make-fixml-session'
import { FixmlSession } from './fixml-session'
import { HttpJsonAdapter } from '../duplex/http-json-adapter'
import { HttpDuplex } from '../duplex/http-duplex'

export function initiator (config: IJsFixConfig, sessionFactory: MakeFixmlSession): Promise<any> {
  const initiatorSession = sessionFactory(config)
  return once(config, initiatorSession)
}

// the adapter will be provided on config
function once (config: IJsFixConfig, initiatorSession: FixmlSession): Promise<any> {
  return new Promise<any>(async (accept, reject) => {
    const logger = config.logFactory.logger('initiator')
    logger.info('connecting ...')
    const initiatorTransport: MsgTransport = new MsgTransport(0, config, new HttpDuplex(new HttpJsonAdapter(config)))
    logger.info('... connected, run session')
    initiatorSession.run(initiatorTransport).then(() => {
      logger.info('ends')
      accept()
    }).catch((e: Error) => {
      logger.error(e)
      reject(e)
    })
  })
}