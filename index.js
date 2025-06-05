const express = require('express')
const cors = require('cors')
const app = express();
const port = process.env.PORT || 3000;
// firebase admin sdk
const admin = require("firebase-admin");

const serviceAccount = require("./job-portal-5953b-firebase-adminsdk-fbsvc-7a1987e550.json");

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

// middleware
app.use(cors());
app.use(express.json());



//! firebase admin sdk\\


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


//!------------------------ verify  firebase token ---------------------------------------->
const verifyFirebaseToken=async(req,res,next)=>{
  // console.log('token in the middleware',req.headers.authorization);
  const authHeader=req.headers?.authorization         // when url hit the header in client side .
  if(!authHeader || !authHeader.startsWith('Bearer ')){
    return res.status(401).send({error:true ,message:'unauthorized access '})
  }
const token=authHeader.split(" ")[1]
try{
  const decoded=await admin.auth().verifyIdToken(token) //verify the token 
  req.decoded=decoded; // store the decoded token in the request object

  console.log('decoded token',decoded);
    next()
}
catch(error){
  return res.status(401).send({error:true,message:'unauthorized access'})
}

}

const verifyTokenEmail=async(req,res,next)=>{
  if(req.query.email !==req.decoded.email){
    return res.status(401).send({message:'forbidden access'})
  }
  next()
}

//!-------------------------------- mongodb ----------------------------------->
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.dgbpvrt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const jobsCollection = client.db('jobDB').collection('job');
    const applicationsCollection = client.db('applyDB').collection('apply')

    // jobs api
    app.get('/jobPortal', async (req, res) => {

      const email = req.query.email;
      const query = {};
      if (email) {
        query.hr_email = email;
      }

      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // could be done but should not be done.
    // app.get('/jobsByEmailAddress', async (req, res) => {
    //   const email = req.query.email;
    //   const query = { hr_email: email }
    //   const result = await jobsCollection.find(query).toArray();
    //   res.send(result);
    // })

    app.get('/jobPortal/applications',verifyFirebaseToken,verifyTokenEmail, async (req, res) => {
      const email = req.query.email;

   
      const query = { hr_email: email };
      const jobs = await jobsCollection.find(query).toArray();

      // should use aggregate to have optimum data fetching
      for (const job of jobs) {
        const applicationQuery = { jobId: job._id.toString() }
        const application_count = await applicationsCollection.countDocuments(applicationQuery)
        job.application_count = application_count;
      }
      res.send(jobs);

    })


    app.get('/jobPortal/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollection.findOne(query);
      res.send(result)
    });

    app.post('/jobPortal', async (req, res) => {
      const newJob = req.body;
      console.log(newJob);
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    })

    
    // job applications related apis
    app.get('/applications',verifyFirebaseToken,verifyTokenEmail, async (req, res) => {
      const email = req.query.email; 
    
      
      if(email !==req.decoded.email){
        return res.status(401).send({error:true ,message:'unauthorized access'})
      }    // admin verify the token and get the email

      const query = {
        applicant: email
      }
      const result = await applicationsCollection.find(query).toArray();

      // bad way to aggregate data
      for (const application of result) {
        const jobId = application.jobId;
        const jobQuery = { _id: new ObjectId(jobId) }
        const job = await jobsCollection.findOne(jobQuery);
        application.company = job.company
        application.title = job.title
        application.company_logo = job.company_logo
      }

      res.send(result);
    });

    // app.get('/applications/:id', () =>{})
    app.get('/applications/job/:job_id', async (req, res) => {
      const job_id = req.params.job_id;
      // console.log(job_id);
      const query = { jobId: job_id }
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/applications', async (req, res) => {
      const application = req.body;
      console.log(application);
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    app.patch('/applications/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: req.body.status
        }
      }

      const result = await applicationsCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Career Code is Cooking')
})

app.listen(port, () => {
  console.log(`Career Code server is running on port ${port}`)
})