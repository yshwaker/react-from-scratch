export type Flags = number

export const NoFlags = 0b0000
// the fiber is new created or is reused but needs to be moved
export const Placement = 0b0001
export const Update = 0b0010
export const ChildDeletion = 0b0100
export const PassiveEffect = 0b1000 // the fiber has effects and at least one of callback need to be invoked

export const MutationMask = Placement | Update | ChildDeletion
// ChildDeletion: if the component is being deleted, we need to call the useEffect cleanup function
export const PassiveMask = PassiveEffect | ChildDeletion
