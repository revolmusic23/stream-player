<template>
  <Slider :lazy="lazy" :tooltips="tooltips" v-bind="$attrs" />
</template>

<script setup lang="ts">
import Slider from '@vueform/slider'

withDefaults(
  defineProps<{
    lazy?: boolean
    tooltips?: boolean
  }>(),
  {
    lazy: false,
    tooltips: false,
  },
)

defineOptions({ inheritAttrs: false })
</script>
