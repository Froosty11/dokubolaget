// Password reset emails. With SMTP_URL (e.g. smtps://user:pass@smtp.example.com)
// and MAIL_FROM set, mail goes out through nodemailer; otherwise the link is
// written to the log so an admin can hand it over.
export type Mailer = { sendReset(to: string, link: string): Promise<void> };

export function createMailer(
  env: { SMTP_URL?: string; MAIL_FROM?: string },
  log: (line: string) => void = (line) => console.log(line),
): Mailer {
  if (!env.SMTP_URL || !env.MAIL_FROM) {
    return {
      async sendReset(to, link) {
        log(`[mail] SMTP not configured. Password reset link for ${to}: ${link}`);
      },
    };
  }
  let transport: any;
  return {
    async sendReset(to, link) {
      if (!transport) {
        const nodemailer = await import("nodemailer");
        transport = nodemailer.createTransport(env.SMTP_URL);
      }
      await transport.sendMail({
        from: env.MAIL_FROM,
        to,
        subject: "Återställ ditt lösenord / Reset your password – Dokubolaget",
        text:
          `Hej!\n\nNågon (förhoppningsvis du) bad om att återställa lösenordet till ditt Dokubolaget-konto.\n` +
          `Someone (hopefully you) asked to reset the password for your Dokubolaget account.\n\n` +
          `${link}\n\nLänken gäller i en timme. / The link works for one hour.\n` +
          `Om det inte var du kan du ignorera det här mejlet. / If it wasn't you, ignore this email.\n`,
      });
    },
  };
}
