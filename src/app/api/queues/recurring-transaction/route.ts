import { Queue } from 'quirrel/next-app';

export const recurringTransactionQueue = Queue(
  'api/queues/recurring-transaction', // 👈 the route it's reachable on
  async (job) => {
    console.log('recurringTransactionQueue', job);
    // await email.send( ... )
  },
);

export const POST = recurringTransactionQueue;
