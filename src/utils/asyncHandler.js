const asyncHandler = async (reqHandler) => {
  (req, res, next) => {
    Promise.resolve(reqHandler(req, res, next)).catch((error) => next(error));
  };
};

export { asyncHandler };

// Second approch
// const asyncHandler = (fun) => async (req, res, next) => {
//   try {
//     await fun(req, res, next);
//   } catch (error) {
//     res.status(error.code || 500).json({
//       success: false,
//       messgae: error.messgae,
//     });
//   }
// };
