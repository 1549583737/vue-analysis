/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin(Vue: Class<Component>) {
  Vue.prototype._init = function(options?: Object) {
    const vm: Component = this
    vm._uid = uid++
    
    let startTag, endTag
    // 浏览器环境&支持window.performance&非生产环境&配置了performance
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }
    
    // a flag to avoid this being observed
    vm._isVue = true
    // 将options进行合并
    if (options && options._isComponent) {        // 是组件
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)          // 组件初始化相关的options合并
    } else {                                      // 是new出来的实例
      vm.$options = mergeOptions(                 // 通过合并策略，将parent与child进行了合并
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)               // 初始化生命周期  src/core/instance/lifecycle.js
    initEvents(vm)                  // 初始化事件  src/core/instance/events.js
    initRender(vm)                  // 初始化render  src/core/instance/render.js
    callHook(vm, 'beforeCreate')    // 触发钩子beforeCreate
    initInjections(vm)              // 初始化注入值 before data/props src/core/instance/inject.js
    initState(vm)                   // 挂载 data、props、methods、watcher、computed
    initProvide(vm)                 // 初始化Provide after data/props
    callHook(vm, 'created')         // 触发钩子created
    
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)       // 挂载
    }
  }
}

/**
 * 组件内的options合并
 * @param vm
 * @param options
 */
export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode
  
  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag
  
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions(Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {                                               // 如果存在父类的时候
    const superOptions = resolveConstructorOptions(Ctor.super)    // 对其父类进行，获取父类的options
    const cachedSuperOptions = Ctor.superOptions         // 之前已经缓存起来的父类的options，用以检测是否更新
    if (superOptions !== cachedSuperOptions) {  // 对比当前父类的option以及缓存中的option，两个不一样则代表已经被更新
      Ctor.superOptions = superOptions        // 如果改变，把新的option缓存起来
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

function dedupe(latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
