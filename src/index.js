import dotenv from "dotenv";
import { connectDB } from "./db/index.js";
import { app } from "./app.js";
const PORT = process.env.PORT || 8000;
dotenv.config({
  path: "./env",
});

connectDB()
  .then(() => {
    app.on("error", () => console.error("Error"));
    app.listen(PORT, () => console.log(`App listing on port: ${PORT}`));
  })
  .catch((error) => console.log("Mongo DB connection failed !!! : ", error));

/*
// First Approch
(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    app.on("error", (error) => {
      console.log(error);
      throw error;
    });

    app.listen(
      process.env.PORT,
      () => `App is listening on ${process.env.PORT}`
    );
  } catch (error) {
    console.error("ERROR: " + error);
    throw error;
  }
})();
*/
