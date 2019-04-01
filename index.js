import 'reflect-metadata'
import { GraphQLModule } from '@graphql-modules/core'
import { ApolloServer } from 'apollo-server-express'
import { Injectable, ProviderScope } from '@graphql-modules/di'
import { PubSub } from 'graphql-subscriptions'
import { subscribe } from 'graphql'
import gql from 'graphql-tag'
import { Server } from 'http'
import express from 'express'

// IMPLEMENTING PROVIDER
@Injectable({
	scope: ProviderScope.Session,
})
class PostProvider {
	constructor() {
		this.instanceId = Math.round(Math.random() * 10000)
	}

	getInstanceId() {
		return this.instanceId
	}

	subscribeForPostUpdate() {
		const triggerName = 'POST_UPDATE'
		const pubsub = new PubSub()
		const asyncIterator = pubsub.asyncIterator(triggerName)

		// Imitating async update
		setTimeout(() => {
			pubsub.publish(triggerName, {
				postAdded: {
					author: 'nshaikhinurov',
					comment: 'Updated a post',
				},
			})
		}, 1000)

		return asyncIterator
	}

	onConnect() {
		console.info('onConnect()')
	}

	onDisonnect() {
		console.info('onDisonnect()')
	}
}

// IMPLEMENTING MODULE
const AppModule = new GraphQLModule({
	providers: [PostProvider],
	typeDefs: gql`
		type Subscription {
			postAdded: Post
		}

		type Query {
			posts: [Post]
		}

		type Post {
			author: String
			comment: String
		}
	`,
	resolvers: {
		Subscription: {
			postAdded: {
				// Additional event labels can be passed to asyncIterator creation
				subscribe: (root, args, { injector }) => {
					console.info('ID %d', injector.get(PostProvider).getInstanceId())
					console.info('ID %d', injector.get(PostProvider).getInstanceId())
					return injector.get(PostProvider).subscribeForPostUpdate()
				},
			},
		},
		Query: {
			posts: (root, args, { injector }) => injector.get(PostsProvider).posts(),
		},
	},
})

// IMPLEMENTING SERVER
const app = express()
const server = Server(app)

const { schema, context, subscriptions } = AppModule

const apolloServer = new ApolloServer({
	schema,
	context,
	subscriptions,
})

apolloServer.applyMiddleware({ app, path: '/api/v1/' })
apolloServer.installSubscriptionHandlers(server)

app.set('host', 'localhost')
app.set('port', 3000)

server.listen(app.get('port'), app.get('host'), () => {
	console.info(`🚀  Server running at http://${app.get('host')}:${app.get('port')}`)
	imitateSubscription()
})

// SUBSCRIPTION
async function imitateSubscription() {
	const asyncIterator = await subscribe({
		schema: AppModule.schema,
		document: gql`
			subscription {
				postAdded {
					author
					comment
				}
			}
		`,
	})
	const iteratorResult = await asyncIterator.next()
	const data = iteratorResult.value.data
	console.log(data)
}
