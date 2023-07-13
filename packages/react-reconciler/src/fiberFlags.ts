export type Flags = number

export const NoFlags = 0b0000
// the fiber is new created or is reused but needs to be moved
export const Placement = 0b0001
export const Update = 0b0010
export const ChildDeletion = 0b0100

export const MutationMask = Placement | Update | ChildDeletion
