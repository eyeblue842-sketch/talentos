import { Router } from 'express';
import { body } from 'express-validator';
import {
  login,
  me,
  oauthCallback,
  saveRecruiterProfile,
  signup,
  startOAuth,
} from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { isPersonalEmail } from '../utils/email.js';

export const authRouter = Router();

authRouter.post(
  '/signup',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['RECRUITER', 'CANDIDATE']),
  body('fullName')
    .if(body('role').equals('CANDIDATE'))
    .notEmpty()
    .withMessage('Full name is required for candidates.'),
  body('email').custom((value, { req }) => {
    if (req.body.role === 'RECRUITER' && isPersonalEmail(value)) {
      throw new Error('Recruiters must use a company email address.');
    }
    return true;
  }),
  validate,
  signup,
);

authRouter.post('/login', body('email').isEmail(), body('password').notEmpty(), validate, login);
authRouter.get('/me', auth(), me);
authRouter.get('/oauth/:provider/start', startOAuth);
authRouter.get('/oauth/:provider/callback', oauthCallback);
authRouter.patch(
  '/recruiter-profile',
  auth(['RECRUITER']),
  body('companyName').notEmpty(),
  body('aboutCompany').notEmpty(),
  body('industryDomain').notEmpty(),
  body('companyType').notEmpty(),
  body('headquartersLocation').notEmpty(),
  body('designation').notEmpty(),
  validate,
  saveRecruiterProfile,
);
