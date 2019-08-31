<template>
  <div class="login">
    <b-input placeHolder="id" v-model="form.id" />
    <b-button @click="onSubmit">Login</b-button>
  </div>
</template>

<script lang="ts">
import { Form } from '@/interfaces/login';
import { Component, Vue } from 'vue-property-decorator';

@Component
export default class Login extends Vue {
  private form: Form = { id: '', password: '' };

  onSubmit = (): void => {
    console.log(this.form.id);
  };
}
</script>

<style scoped></style>
