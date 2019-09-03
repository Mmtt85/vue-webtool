<template>
  <b-navbar-nav class="ml-auto">
    <template v-if="$store.state.auth.id">
      <b-nav-item title="account">{{ $store.state.auth.id }}</b-nav-item>
      <b-nav-item title="logout" @click="onLogout">
        <font-awesome-icon icon="sign-out-alt" />
      </b-nav-item>
    </template>
    <template v-else>
      <b-nav-item title="login" @click="toggleLoginWindow"
        ><font-awesome-icon icon="sign-in-alt"
      /></b-nav-item>
    </template>
    <Login />
  </b-navbar-nav>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Login from '@/components/Login.vue';

@Component({
  components: {
    Login
  },
  data() {
    return {
      isLoginShow: false
    };
  }
})
export default class UserInfo extends Vue {
  toggleLoginWindow() {
    this.$bvModal.show('login-modal');
  }
  onLogout() {
    this.$store.commit('logout');
  }
}
</script>

<style scoped></style>
