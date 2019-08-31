<template>
  <div class="login">
    <b-button>Login</b-button>
  </div>
</template>

<script>
import { Component, Vue } from 'vue-property-decorator';

@Component({
  data() {
    return {
      form: {
        id: '',
        password: ''
      }
    };
  },
  methods: {
    onSubmit: e => {
      e.preventDefault();
      alert(this.form);
    },
    onReset: e => {
      e.preventDefault();
      this.form.id = '';
      this.form.password = '';
    }
  }
})
export default class Login extends Vue {}
</script>

<style scoped></style>
