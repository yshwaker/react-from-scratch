export type Flags = number

export const NoFlags = 0b0000000
// the fiber is new created or is reused but needs to be moved
export const Placement = 0b0000001
export const Update = 0b0000010
export const ChildDeletion = 0b0000100
export const PassiveEffect = 0b0001000 // the fiber has effects and at least one of callback need to be invoked
export const Ref = 0b0010000
export const Visibility = 0b0100000
export const DidCapture = 0b1000000

export const ShouldCapture = 0b10000000000000000

export const MutationMask =
  Placement | Update | ChildDeletion | Ref | Visibility
export const LayoutMask = Ref
// ChildDeletion: if the component is being deleted, we need to call the useEffect cleanup function
export const PassiveMask = PassiveEffect | ChildDeletion
