/**
 * 插件接口
 *
 * @interface Plugin
 */

/**
 * 判断给定的内容是否是该类型的 Message
 *
 * @name Plugin.messageClasses
 * @type AVMessage[]
 */

/**
 * 解析处理消息内容 （JSON -> AVMessage）
 *
 * @name Plugin.onRealtimeCreate
 * @type Function
 */

/**
 * 将当前消息序列化为 JSON 对象 （AVMessage -> JSON)
 *
 * @name Plugin.beforeMessageParse
 * @type Function
 */

import { ensureArray, tap } from './utils';


const checkType = middleware => param => {
  const { constructor } = param;
  return Promise.resolve(param).then(middleware).then(tap(result => {
    if (result === undefined || result === null) {
      // eslint-disable-next-line max-len
      return console.warn(`Middleware[${middleware.name || 'anonymous'}] param/return types not match. It returns ${result} while a ${param.constructor.name} expected.`);
    }
    if (!(result instanceof constructor)) {
      // eslint-disable-next-line max-len
      return console.warn(`Middleware[${middleware.name || 'anonymous'}] param/return types not match. It returns a ${result.constructor.name} while a ${param.constructor.name} expected.`);
    }
    return 0;
  }));
};

export const applyDecorators = (decorators, target) => {
  if (decorators) {
    for (const decorator of decorators) {
      decorator(target);
    }
  }
};

export const applyMiddlewares = middlewares => target =>
  ensureArray(middlewares).reduce(
    (previousPromise, middleware) => previousPromise.then(checkType(middleware)),
    Promise.resolve(target)
  );
