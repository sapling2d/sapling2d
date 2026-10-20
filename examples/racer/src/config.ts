/** 公路：居中、宽 600，两边是草地（背景色）。 */
export const ROAD = { left: 75, right: 675, color: 0x3c3c3c, edgeColor: 0xdddddd, edgeWidth: 10 }

/** 车道线：中间一列白色短线向下滚动。 */
export const LANE = { width: 10, height: 80, gap: 160, speed: 600, color: 0xffffff }

/** 车：满力度时每秒横移 500 像素；车身不出公路。 */
export const CAR = { width: 60, height: 100, y: 1100, steerSpeed: 500, color: 0xd93025 }
