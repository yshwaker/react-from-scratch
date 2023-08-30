export type Flags = number

export const NoFlags = 0b000000
// the fiber is new created or is reused but needs to be moved
export const Placement = 0b000001
export const Update = 0b000010
export const ChildDeletion = 0b000100
export const PassiveEffect = 0b001000 // the fiber has effects and at least one of callback need to be invoked
export const Ref = 0b010000
export const Visibility = 0b100000

export const MutationMask =
  Placement | Update | ChildDeletion | Ref | Visibility
export const LayoutMask = Ref
// ChildDeletion: if the component is being deleted, we need to call the useEffect cleanup function
export const PassiveMask = PassiveEffect | ChildDeletion
