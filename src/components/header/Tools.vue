<template>
  <b-navbar-nav>
    <b-nav-item-dropdown text="Tools">
      <b-dropdown-item href="#" @click="goBase64">Base64</b-dropdown-item>
    </b-nav-item-dropdown>
  </b-navbar-nav>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component
export default class Tools extends Vue {
  goBase64() {
    if (this.$router.currentRoute.path !== '/base64')
      this.$router.push('/base64');
  }
}
</script>
