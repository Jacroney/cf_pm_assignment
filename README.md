# cf_pm_assignment

Problem: As a team one of our biggest issues is figuring out what feedback is most important. We have information come in from multiple different sources and we do not have a clear way to identify the value of each feedback.

Without this structure teams stuggle to answer:

1. what issues are most common?
2. What feedback is urgent vs informational?
3. Where should the team focus next?

Solution: We need to design a system that consolidates all of the feedback from the sources so we can analyze what is most important to address and the urgency of each issues.

To do so we will make a feedback intelligence pipeline built on cloudflare.
The system will:

1. Get feedback from multiple sources
2. Use Workers AI to clasify themes, urgency, and sentiment of feedback
3. Store the now structured feedback in D1
4. Use a DO to keep track of most common feedback themes.
5. Provide the team with a summary of most important feedback.

In this system "importance" is defined as a combination of theme frequency, negative sentiment, and urgency.

Design:  
Workers (compute):

1. POST /feedback - Ingest all feedback
2. GET /summary - Pull analyzed feedback
   Goal: Act as API entry route. Workers are optimal because they run globally, and integrate with all other systems in project.

Workers AI (classification):

1. Analyze feedback for theme, sentiment, urgency, and a summary
   Goal: transform unstructured feedback into strucured queryable data
   Tradeoff: Analyzing on ingestion will slow down intake. But we will be able to access the data later for summary step

D1 Database (storage):

1. Store structured feedback as
   1. Text
   2. Metadata from source
   3. Workers AI derived Theme/sentiment

Durable Objects (aggregation)

1. use a DO tp maintain real-time theme count
   Goal: Enable low latency summary reads for the team. Reduce expensive queries to D1.
   Tradeoff: Adds complexity to architecture but improves performance and corrdination.
