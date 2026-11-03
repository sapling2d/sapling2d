<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { demos } from '../demos'

const props = defineProps<{ name: string }>()
const demo = computed(() => demos.find((d) => d.name === props.name))
const src = computed(() => withBase(`/demos/${props.name}/`))
const source = computed(() => `https://github.com/sapling2d/sapling2d/tree/main/examples/${props.name}`)
// 不自动加载：游戏会占 GPU、可能出声，点了才开始
const started = ref(false)
</script>

<template>
  <div v-if="demo" class="demo" :class="{ landscape: demo.landscape }">
    <div class="frame">
      <iframe v-if="started" :src="src" :title="demo.title" allow="autoplay; fullscreen; accelerometer; gyroscope" />
      <button v-else class="start" type="button" @click="started = true">
        <span class="play" aria-hidden="true">▶</span>
        <span>开始 {{ demo.title }}</span>
      </button>
    </div>
    <div class="info">
      <h3 :id="demo.name">{{ demo.title }}</h3>
      <p>{{ demo.description }}</p>
      <p class="controls"><strong>操作</strong>：{{ demo.controls }}</p>
      <p class="links">
        <a v-for="f in demo.features" :key="f.link" :href="withBase(f.link)">{{ f.text }}</a>
        <a :href="source" target="_blank" rel="noreferrer">源码 ↗</a>
        <a :href="src" target="_blank" rel="noreferrer">全屏打开 ↗</a>
      </p>
    </div>
  </div>
  <p v-else class="warning">未知的示例：{{ name }}</p>
</template>

<style scoped>
.demo {
  display: grid;
  grid-template-columns: minmax(0, 280px) 1fr;
  gap: 24px;
  margin: 24px 0 40px;
  align-items: start;
}
.demo.landscape {
  grid-template-columns: 1fr;
}
.frame {
  aspect-ratio: 750 / 1334;
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
}
.landscape .frame {
  aspect-ratio: 480 / 272;
}
.frame iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.start {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  cursor: pointer;
}
.start:hover {
  color: var(--vp-c-brand-1);
}
.play {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 20px;
  padding-left: 4px;
}
.info h3 {
  margin-top: 0;
}
.controls {
  color: var(--vp-c-text-2);
  font-size: 14px;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 14px;
}
@media (max-width: 640px) {
  .demo {
    grid-template-columns: 1fr;
  }
  .frame {
    max-width: 320px;
  }
  .landscape .frame {
    max-width: none;
  }
}
</style>
