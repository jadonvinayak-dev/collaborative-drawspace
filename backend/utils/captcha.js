const generateCaptcha = (req, formId = "default") => {
  const a  = Math.floor(Math.random() * 15) + 1;
  const b  = Math.floor(Math.random() * 15) + 1;
  const op = a >= b && Math.random() > 0.5 ? "-" : "+";
  const answer = op === "+" ? a + b : a - b;

  if (!req.session.captcha) req.session.captcha = {};
  req.session.captcha[formId] = {
    answer,
    expires: Date.now() + 5 * 60 * 1000,
  };

  return { question: `${a} ${op} ${b}` };
};

const verifyCaptcha = (req, submittedAnswer, formId = "default") => {
  const entry = req.session.captcha?.[formId];

  if (req.session.captcha) delete req.session.captcha[formId];

  if (!entry || Date.now() > entry.expires) return false;
  if (submittedAnswer === undefined || submittedAnswer === null || submittedAnswer === "") return false;

  return Number(submittedAnswer) === Number(entry.answer);
};

module.exports = { generateCaptcha, verifyCaptcha };
