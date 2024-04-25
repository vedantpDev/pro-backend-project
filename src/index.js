import dotenv from "dotenv";
import { connectDB } from "./db/index.js";
dotenv.config({
  path: "./env",
});
connectDB();

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
