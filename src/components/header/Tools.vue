<template>
  <b-navbar-nav>
    <b-nav-item-dropdown text="Tools">
      <b-dropdown-item href="#" @click="goTools('/base64')"
        >Base64</b-dropdown-item
      >
      <b-dropdown-item href="#" @click="goTools('/makePW')"
        >make password</b-dropdown-item
      >
      <b-dropdown-item href="#" @click="goTools('/jsonParser')"
        >json parser</b-dropdown-item
      >
    </b-nav-item-dropdown>
  </b-navbar-nav>
</template>

<script lang="ts">
import { ToolsPath } from '@/interfaces/menu-path';
import { Component, Vue } from 'vue-property-decorator';

@Component
export default class Tools extends Vue {
  goTools(path: ToolsPath) {
    if (this.$router.currentRoute.path !== path) this.$router.push(path);
  }
}
</script>
