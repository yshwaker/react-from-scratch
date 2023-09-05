const supportSymbol = typeof Symbol === 'function' && Symbol.for

export const REACT_ELEMENT_TYPE = supportSymbol
  ? Symbol.for('react.element')
  : // why this number ? because it looks like the word 'react'
    0xeac7

export const REACT_FRAGMENT_TYPE = supportSymbol
  ? Symbol.for('react.fragment')
  : 0xeacb

export const REACT_CONTEXT_TYPE = supportSymbol
  ? Symbol.for('react.context')
  : 0xeacc

export const REACT_PROVIDER_TYPE = supportSymbol
  ? Symbol.for('react.provider')
  : 0xeac2

export const REACT_SUSPENSE_TYPE = supportSymbol
  ? Symbol.for('react.suspense')
  : 0xeac3

export const REACT_MEMO_TYPE = supportSymbol ? Symbol.for('react.memo') : 0xeac4
