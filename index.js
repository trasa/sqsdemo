#!/usr/bin/env node

const
    program = require('commander'),
    aws = require('aws-sdk');

aws.config.update({region: 'us-east-1'});
const sqs = new aws.SQS()

program.version(module.exports.version);

// This creates a queue if needed, then sends some simple messages to the queue
program
    .command('publish')
    .description('sends to sqs')
    .action(async () => {
        console.log("Let's publish!");

        // create the queue if necessary;
        // retrieves the queueUrl either way.
        let queueUrl = await createQueue();
        console.log("sending to queueUrl", queueUrl);

        // send some messages, waiting a bit between each send
        for(let i=0; i < 5; i++) {
            await new Promise((resolve, reject) => {
                sqs.sendMessage({
                    MessageBody: 'Hello, world! Time is ' + (new Date).getTime(),
                    QueueUrl: queueUrl
                }, (err, data) => {
                    if (err) {
                        console.log("Failed to send message", err);
                        return reject(err);
                    } else {
                        console.log("Message sent", data.MessageId);
                        resolve();
                    }
                })
            });
            console.log("sleeping for a bit...");
            await sleep(1000);
        }
        console.log("done.");
    });


// This creates a queue if necessary, then subscribes to get messages from the queue
program
    .command('subscribe')
    .description('receives from sqs')
    .action(async () => {

        // create the queue if you must, get the url
        let queueUrl = await createQueue();
        console.log("receiving from", queueUrl);

        // normally you'd run this in some sort of loop,
        // polling every 'interval'; but take care because
        // each polling counts vs. the cost even if there are
        // no messages to consume.
        // so the trick is to find the right balance.
        await new Promise((resolve, reject) => {

            // grab a bunch of messages
            sqs.receiveMessage({
                MaxNumberOfMessages: 10, // max allowed
                QueueUrl: queueUrl,
                WaitTimeSeconds: 10
            }, (err, data) => {
                if (err) {
                    console.log("Failed to read messages", err);
                    return reject(err);
                } else {
                    if (!data.Messages) {
                        console.log("No messages received!");
                        return resolve();
                    }
                    // found some messages.
                    console.log("Recieved", data.Messages.length, "messages");
                    for (let i=0; i < data.Messages.length; i++) {
                        // do something meaningful with the message you are processing...
                        console.log("Message received:", data.Messages[i].MessageId, data.Messages[i].Body);

                        // delete the message because we're done with it.
                        sqs.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: data.Messages[i].ReceiptHandle},
                            (err, data) => { if (err) { console.log("Failed to delete message", data.Messages[i]);}});
                    }
                    return resolve();
                }
            });
        });
    });


async function createQueue() {
    return new Promise((resolve, reject) => {
        sqs.createQueue({
            QueueName: 'tony_demo',
            Attributes: {
                'MessageRetentionPeriod': '86400' // don't keep messages longer than a day
            }
        }, (err, data) => {
            if (err) {
                console.log("Failed to create queue:", err);
                reject(err);
            } else {
                console.log("Successfully created queue:", data.QueueUrl)
                resolve(data.QueueUrl);
            }
        })
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showHelpAndExitIfNoArgs() {
    if (!program.args.length) {
        program.help();
    }
}

program.parse(process.argv);
showHelpAndExitIfNoArgs();