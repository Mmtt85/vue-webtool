<template>
  <b-navbar toggleable="lg" type="dark" variant="info">
    <b-navbar-brand title="home" href="#" @click="goHome">
      <font-awesome-icon icon="home" />
    </b-navbar-brand>
    <b-navbar-toggle target="nav-collapse"></b-navbar-toggle>
    <b-collapse title="tools" id="nav-collapse" is-nav>
      <Tools />
      <UserInfo />
    </b-collapse>
  </b-navbar>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

import Tools from '@/components/header/Tools.vue';
import UserInfo from '@/components/header/UserInfo.vue';

@Component({
  components: {
    Tools,
    UserInfo
  }
})
export default class Index extends Vue {
  goHome() {
    const { $router } = this;
    if ($router.currentRoute.path !== '/') $router.push('/');
  }
}
</script>
