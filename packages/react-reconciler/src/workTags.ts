export type WorkTag =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText
  | typeof Fragment
  | typeof ContextProvider
  | typeof SuspenseComponent
  | typeof OffscreenComponent
export const FunctionComponent = 0
export const HostRoot = 3 // React root created by ReactDom.createRoot()
export const HostComponent = 5 // <div>
export const HostText = 6 // abc under <div>abc></div>
export const Fragment = 7
export const ContextProvider = 8
export const SuspenseComponent = 13
export const OffscreenComponent = 14
