<script setup lang="ts">
import { marked } from "marked";
import DOMPurify from "dompurify";

const props = defineProps<{
  content: string;
}>();

marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderedHtml = computed(() => {
  const rawHtml = marked.parse(props.content) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "strong", "em", "del", "s",
      "ul", "ol", "li",
      "blockquote",
      "pre", "code",
      "a",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
});
</script>

<template>
  <div class="prose prose-sm max-w-none" v-html="renderedHtml" />
</template>
