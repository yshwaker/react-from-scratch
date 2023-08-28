export type Flags = number

export const NoFlags = 0b00000
// the fiber is new created or is reused but needs to be moved
export const Placement = 0b00001
export const Update = 0b00010
export const ChildDeletion = 0b00100
export const PassiveEffect = 0b01000 // the fiber has effects and at least one of callback need to be invoked
export const Ref = 0b10000

export const MutationMask = Placement | Update | ChildDeletion | Ref
export const LayoutMask = Ref
// ChildDeletion: if the component is being deleted, we need to call the useEffect cleanup function
export const PassiveMask = PassiveEffect | ChildDeletion
