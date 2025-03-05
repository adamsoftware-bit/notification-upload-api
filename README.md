# Gmail Sender

This project allows you to send emails using Gmail's SMTP server.

## Setup

1. Clone the repository.
2. Install the required dependencies using `npm install`.
3. Configure the `config/credentials.json` file with your Gmail API service account credentials.

## Usage

Run the server:
```bash
node index.js
```

Send a POST request to `http://localhost:3000/send-email` with the following JSON body:
```json
{
    "to": "recipient-email@gmail.com",
    "subject": "Email Subject",
    "text": "Email content"
}
```
