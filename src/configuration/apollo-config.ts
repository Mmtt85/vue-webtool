import VueApollo from 'vue-apollo';
import { ApolloClient } from 'apollo-client';
import { onError } from 'apollo-link-error';
import { setContext } from 'apollo-link-context';
import { createHttpLink } from 'apollo-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';

const httpLink = createHttpLink({
  // You should use an absolute URL here
  uri: 'http://localhost:8080/graphql'
});

const authLink = setContext(async (request, all) => {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...all.headers
    }
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (networkError) {
    // console.log('network error', networkError);
  }
  if (graphQLErrors) {
    // console.log(graphQLErrors);
  }
});
// Cache implementation
const cache = new InMemoryCache();

// Create the apollo client
const defaultClient = new ApolloClient({
  link: authLink.concat(errorLink).concat(httpLink),
  cache
});

const apolloProvider = new VueApollo({
  defaultClient
});

export default apolloProvider;
