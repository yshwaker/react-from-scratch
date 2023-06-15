import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'
import {
  ElementType,
  Key,
  Props,
  ReactElement,
  Ref,
  Type,
} from 'shared/ReactTypes'

// react element constructor
const ReactElement = function (
  type: Type,
  key: Key,
  ref: Ref,
  props: Props
): ReactElement {
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

export const jsx = (
  type: ElementType,
  config: any,
  ...maybeChildren: Array<any>
) => {
  let key: Key = null
  const props: Props = {}
  let ref: Ref = null

  const keys = Object.keys(config)

  for (const prop of keys) {
    const val = config[prop]
    if (prop === 'key') {
      if (val !== undefined) {
        key = '' + val
      }
    } else if (props === 'ref') {
      if (val !== undefined) {
        ref = val
      }
    } else {
      props[prop] = val
    }
  }

  const maybeChildrenLength = maybeChildren.length
  if (maybeChildrenLength === 1) {
    props.children = maybeChildren[0]
  }
  if (maybeChildrenLength > 1) {
    props.children = maybeChildren
  }

  return ReactElement(type, key, ref, props)
}

// in the official react library, jsxDev comes with more debug info which is skipped here.
export const jsxDev = jsx
