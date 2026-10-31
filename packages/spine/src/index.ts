export { spineSkeleton, SpineSkeleton, SpinePageTexture, type SpineSkeletonOptions } from './resource'
export { SpineSprite, type SpineSpriteOptions, type SpineEvent, type SpinePlayOptions, type SpineQueueOptions, type SpinePhysicsMode } from './SpineSprite'
export { SpineBoneNode, type SpineBoneNodeOptions } from './SpineBoneNode'
export { spine } from './plugin'
export { SpineRuntime } from './runtime'
export { SpineContent } from './render'
// spine-core 的类型，给进阶用法（`sprite.state` / `sprite.spine`）标注用；值从 '@esotericsoftware/spine-core' 直接 import
export type { AnimationState, AnimationStateData, Bone, BonePose, Skeleton, SkeletonData, Skin, Slot, TrackEntry } from '@esotericsoftware/spine-core'
