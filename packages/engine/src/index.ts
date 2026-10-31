export { Node, type NodeOptions, type DumpNode, type ProcessMode } from './core/Node'
export { Node2D, type Node2DOptions, type BlendMode } from './core/Node2D'
export { Scene, type SceneClass, type SceneConstructor } from './core/Scene'
export { SceneTree, type SceneTreeOptions, type DumpOptions, type NodeClass, type SystemClass, type TreeSystem } from './core/SceneTree'
export { Vector2, v } from './math/Vector2'
export { Rect2, rect } from './math/Rect2'
export { Curve2D, type CurvePoint, type Curve2DOptions } from './math/Curve2D'
export { Viewport, MAX_RENDER_RESOLUTION, type StretchAspect, type DesignResolution, type ScreenInfo } from './core/Viewport'
export { RandomNumberGenerator } from './math/RandomNumberGenerator'
export type { Platform, PlatformKind, LoadedImage } from './platform/Platform'
export { HeadlessPlatform } from './platform/HeadlessPlatform'
export { Signal, type SignalResult } from './core/Signal'
export { Tween, type TweenOptions, type TweenProps, type TweenableKey } from './core/Tween'
export { Ease, type EaseFn } from './math/ease'
export { Timer, type TimerOptions } from './nodes/Timer'
export { SceneTreeTimer } from './core/SceneTreeTimer'
export { Transform2D } from './math/Transform2D'
export type { Renderer } from './core/Renderer'

// 输入
export { Input, pointerPress, type InputBinding, type PointerBinding, type RawInputEvent, type RawPointerEvent, type InputSource } from './input/Input'
export type { ActionName } from './input/actions'
export type { PointerEvent2D, CircleHitArea } from './core/pointer'
export type { Plugin, PluginContext, ServiceToken } from './core/plugin'
export { keyboard, key, Keyboard, type RawKeyEvent, type KeyBinding } from './plugins/keyboard'
export type { GroupName, GroupNodeType } from './core/groups'
// 用声明合并扩展的注册表（`declare module 'sapling2d' { interface ActionRegistry { … } }`）：接口在 core/registries.ts，这里按名字 re-export
export type { InputEventRegistry, InputBindingRegistry, GroupRegistry, ActionRegistry, StorageRegistry } from './core/registries'

// 节点
export { Sprite2D, type Sprite2DOptions } from './nodes/Sprite2D'
export { AnimatedSprite2D, type AnimatedSprite2DOptions } from './nodes/AnimatedSprite2D'
export { TileMapLayer, type TileMapLayerOptions } from './nodes/TileMapLayer'
export { TileLayers } from './nodes/TileLayers'
export { CharacterBody2D, type CharacterBody2DOptions, type SlideCollision } from './nodes/CharacterBody2D'
export { Camera2D, type Camera2DOptions } from './nodes/Camera2D'
export { CameraManager } from './nodes/CameraManager'
export { CanvasLayer, type CanvasLayerOptions } from './nodes/CanvasLayer'
export { CollisionObject2D, type CollisionObject2DOptions } from './nodes/physics/CollisionObject2D'
export { PhysicsBody2D, StaticBody2D, type PhysicsBody2DOptions } from './nodes/physics/PhysicsBody2D'
export { Area2D, type Area2DOptions } from './nodes/physics/Area2D'
export { RigidBody2D, type RigidBody2DOptions } from './nodes/physics/RigidBody2D'
export { CollisionShape2D, type CollisionShape2DOptions } from './nodes/physics/CollisionShape2D'
export { ColorRect, type ColorRectOptions } from './nodes/ColorRect'
export { NineSliceSprite, type NineSliceSpriteOptions, type NineSliceMargins } from './nodes/NineSliceSprite'
export { Particles2D, type Particles2DOptions } from './nodes/Particles2D'
export { Label, type LabelOptions, type LabelStroke, type HorizontalAlignment, type VerticalAlignment } from './nodes/Label'
export { AudioStreamPlayer, type AudioStreamPlayerOptions } from './nodes/AudioStreamPlayer'

// 物理
export { CircleShape2D, RectangleShape2D, ConvexPolygonShape2D, circle, rectangle, polygon, MAX_POLYGON_VERTICES, type Shape2D } from './physics/shapes'
export { PhysicsWorld, type PhysicsSettings } from './physics/PhysicsWorld'
export { HitTester, type Hittable } from './physics/HitTester'

// 资源
export { AssetLoader } from './assets/AssetLoader'
export type { AssetMap, Resource } from './assets/Resource'
export { Texture, tex } from './assets/Texture'
export { SpriteSheet, sheet, Atlas, atlas, type AtlasData, type AtlasFrameData } from './assets/SpriteSheet'
export type { SpriteAnimation } from './assets/SpriteAnimation'
export {
  AsepriteSheet,
  aseprite,
  type AsepriteData,
  type AsepriteFrameData,
  type AsepriteTagData,
  type AsepriteSliceData,
  type AsepriteSliceKey,
  type AsepriteAnimationOptions,
} from './assets/AsepriteSheet'
export { TileSet, tileset, type TileSetOptions, type TileOptions, type TileData, type TileCollision } from './assets/TileSet'
export { TiledMap, tiledMap, type TiledObject, type TiledObjectLayer, type TiledTileLayer } from './assets/TiledMap'

// 音频与存储
export { AudioStream, sfx, music } from './audio/AudioStream'
export { AudioServer, Voice, type AudioBus, type PlayOptions } from './audio/AudioServer'
export type { AudioBackend, SoundHandle } from './audio/backend'
export type { PlayedSound } from './audio/HeadlessAudio'
export { Storage } from './storage/Storage'
export { MemoryStorageBackend, type StorageBackend } from './storage/backend'

// 运行时
export { Game, type GameOptions, type LoadingScreen, type FrameStats } from './runtime/Game'
export { DefaultLoadingScene } from './runtime/DefaultLoadingScene'
