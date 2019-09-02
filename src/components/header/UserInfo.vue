<template>
  <b-navbar-nav class="ml-auto">
    <template v-if="$store.state.auth.id">
      <b-nav-item title="account">{{ $store.state.auth.id }}</b-nav-item>
      <b-nav-item title="logout" @click="onLogout">
        <font-awesome-icon icon="sign-out-alt" />
      </b-nav-item>
    </template>
    <template v-else>
      <b-nav-item title="login" @click="onLogin"
        ><font-awesome-icon icon="sign-in-alt"
      /></b-nav-item>
    </template>
  </b-navbar-nav>
</template>
<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component
export default class UserInfo extends Vue {
  onLogin() {
    this.$store.commit('login', { id: 'test@user.login' });
  }
  onLogout() {
    this.$store.commit('logout');
  }
}
</script>

<style scoped></style>
