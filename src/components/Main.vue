<template>
  <div id="main" class="main">
    <Header />
    <Body />
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

import Header from '@/components/header/Index.vue';
import Body from '@/components/body/Index.vue';

@Component({
  components: {
    Header,
    Body
  }
})
export default class Home extends Vue {}
</script>
