const supportSymbol = typeof Symbol === 'function' && Symbol.for

export const REACT_ELEMENT_TYPE = supportSymbol
  ? Symbol.for('react.element')
  : // why this number ? because it looks like the word 'react'
    0xeac7
