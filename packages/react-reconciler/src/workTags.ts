export type WorkTag =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText
export const FunctionComponent = 0
export const HostRoot = 3 // React root created by ReactDom.createRoot()
export const HostComponent = 5 // <div>
export const HostText = 6 // abc under <div>abc></div>