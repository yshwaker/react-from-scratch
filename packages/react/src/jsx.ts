import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'
import { ElementType, Key, Props, React$Element, Ref } from 'shared/ReactTypes'

// react element constructor
const ReactElement = function (
  type: ElementType,
  key: Key,
  ref: Ref,
  props: Props
): React$Element {
  const element = {
    // this is used to prevent hackers from faking a react element using plain object
    // see also https://overreacted.io/why-do-react-elements-have-typeof-property/
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
    __mark: 'unofficial',
  }

  return element
}

export function isValidElement(object: any) {
  return (
    typeof object === 'object' &&
    object !== null &&
    object.$$typeof === REACT_ELEMENT_TYPE
  )
}

export const jsx = (
  type: ElementType,
  config: any,
  ...children: Array<any>
) => {
  let key: Key = null
  const props: Props = {}
  let ref: Ref = null

  for (const prop in config) {
    const val = config[prop]
    if (prop === 'key') {
      if (val !== undefined) {
        key = '' + val
      }
    } else if (prop === 'ref') {
      if (val !== undefined) {
        ref = val
      }
    } else if (Object.prototype.hasOwnProperty.call(config, prop)) {
      props[prop] = val
    }
  }

  const childrenLength = children.length
  if (childrenLength >= 1) {
    props.children = childrenLength > 1 ? children : children[0]
  }

  return ReactElement(type, key, ref, props)
}

export const jsxDEV = (type: ElementType, config: any) => {
  let key: Key = null
  const props: Props = {}
  let ref: Ref = null

  for (const prop in config) {
    const val = config[prop]
    if (prop === 'key') {
      if (val !== undefined) {
        key = '' + val
      }
    } else if (prop === 'ref') {
      if (val !== undefined) {
        ref = val
      }
    } else if (Object.prototype.hasOwnProperty.call(config, prop)) {
      props[prop] = val
    }
  }

  return ReactElement(type, key, ref, props)
}
