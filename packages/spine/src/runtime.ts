/**
 * `spine()` 提供的服务：装了插件的标志，带运行时版本。`tree.get(SpineRuntime)`。
 * 放在单独的文件里：节点和插件都要引用它，避免循环 import。
 */
export class SpineRuntime {
  /** 本插件读取的 Spine 导出版本（编辑器的 major.minor）。 */
  readonly version = '4.3'
}

/** @internal 本插件支持的 Spine 导出版本（`skeleton.spine` 的 major.minor）。 */
export const SUPPORTED_VERSION = '4.3'
