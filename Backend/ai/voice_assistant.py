import speech_recognition as sr
import pyttsx3
from flask import Flask, request, jsonify
from pymongo import MongoClient
import dateparser
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from google.oauth2 import service_account

app = Flask(__name__)

# MongoDB setup
MONGO_URI = "mongodb+srv://Healthcare1:123456789H@cluster0.wizfxel.mongodb.net/arogya-vault"
client = MongoClient(MONGO_URI)
db = client["AarogyaDB"]
appointments_collection = db["appointments"]
leaves_collection = db["leaves"]

# Text-to-speech setup
engine = pyttsx3.init()

def speak(text):
    engine.say(text)
    engine.runAndWait()

def listen():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("Listening...")
        audio = recognizer.listen(source)
    try:
        return recognizer.recognize_google(audio)
    except:
        return None

# Google Calendar Setup
SCOPES = ['https://www.googleapis.com/auth/calendar']
SERVICE_ACCOUNT_FILE = 'credentials.json'

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)
service = build('calendar', 'v3', credentials=credentials)
CALENDAR_ID = 'primary'

def create_google_calendar_event(appointment):
    start_datetime = datetime.strptime(f"{appointment['date']} {appointment['time']}", "%Y-%m-%d %I:%M %p")
    end_datetime = start_datetime + timedelta(minutes=30)

    event = {
        'summary': f"Appointment with Dr. {appointment['doctor_name']}",
        'description': f"Purpose: {appointment['purpose']}. Token number: {appointment['token_number']}",
        'start': {
            'dateTime': start_datetime.isoformat(),
            'timeZone': 'Asia/Kolkata',
        },
        'end': {
            'dateTime': end_datetime.isoformat(),
            'timeZone': 'Asia/Kolkata',
        },
    }
    event_result = service.events().insert(calendarId=CALENDAR_ID, body=event).execute()
    return event_result.get('htmlLink')

def book_appointment_flow():
    speak("Please tell me the doctor's name.")
    doctor_name = None
    while not doctor_name:
        response = listen()
        if response:
            doctor_name = response
        else:
            speak("I didn't catch that. Please tell me the doctor's name again.")

    speak("What is the purpose of your appointment?")
    purpose = None
    while not purpose:
        response = listen()
        if response:
            purpose = response
        else:
            speak("Sorry, please repeat the purpose of your appointment.")

    speak("On which date would you like to book the appointment? You can say 14 April or 14.04.2025.")
    appointment_date = None
    while not appointment_date:
        response = listen()
        if response:
            parsed_date = dateparser.parse(response)
            if parsed_date:
                appointment_date = parsed_date.date()
            else:
                speak("Sorry, I couldn't understand the date. Please say it again.")
        else:
            speak("Sorry, please repeat the date.")

    speak("At what time would you like to schedule the appointment?")
    appointment_time = None
    while not appointment_time:
        response = listen()
        if response:
            try:
                parsed_time = dateparser.parse(response)
                if parsed_time:
                    time_obj = parsed_time.time()
                    if time_obj >= datetime.strptime("10:00", "%H:%M").time() and time_obj < datetime.strptime("18:00", "%H:%M").time():
                        if time_obj >= datetime.strptime("13:00", "%H:%M").time() and time_obj < datetime.strptime("14:00", "%H:%M").time():
                            speak("Sorry, 1 PM to 2 PM is lunch break. Please choose another time.")
                        else:
                            appointment_time = parsed_time.strftime("%I:%M %p")
                    else:
                        speak("Appointments are only available between 10 AM and 6 PM. Please choose a valid time.")
                else:
                    speak("Sorry, I couldn't understand the time. Please say it again.")
            except:
                speak("Sorry, I couldn't understand the time. Please say it again.")
        else:
            speak("Sorry, I didn't get that. Please tell the time again.")

    # Generate token number
    existing = appointments_collection.count_documents({"date": str(appointment_date)})
    token_number = existing + 1

    # Save to DB
    appointment = {
        "doctor_name": doctor_name,
        "purpose": purpose,
        "date": str(appointment_date),
        "time": appointment_time,
        "token_number": token_number
    }
    appointments_collection.insert_one(appointment)

    # Create Google Calendar event
    calendar_link = create_google_calendar_event(appointment)

    confirmation = f"Your appointment request is submitted successfully for {doctor_name} on {appointment_date.strftime('%d %B')} at {appointment_time} for {purpose}. Your token number is {token_number}."
    speak(confirmation)
    speak("I have also added this to your Google Calendar.")
    return {**appointment, "calendar_link": calendar_link}

def apply_leave_flow():
    speak("Please tell me the date of leave.")
    leave_date = None
    while not leave_date:
        response = listen()
        if response:
            parsed_date = dateparser.parse(response)
            if parsed_date:
                leave_date = parsed_date.date()
            else:
                speak("Sorry, I couldn't understand the date. Please say it again.")
        else:
            speak("Sorry, please repeat the date of leave.")

    speak("Please tell me the reason for leave.")
    reason = None
    while not reason:
        response = listen()
        if response:
            reason = response
        else:
            speak("Sorry, please repeat the reason for leave.")

    leave = {
        "date": str(leave_date),
        "reason": reason
    }
    leaves_collection.insert_one(leave)

    confirmation = f"Your leave for {leave_date.strftime('%d %B')} is recorded successfully for the reason: {reason}."
    speak(confirmation)
    return leave

@app.route('/voice-command', methods=['GET'])
def voice_command():
    speak("Hello, I am Aarogya Mitra. How can I help you today? You can say book appointment, apply for leave, or exit.")
    while True:
        command = listen()
        if command:
            command = command.lower()
            if "book appointment" in command:
                book_appointment_flow()
            elif "apply for leave" in command or "leave application" in command:
                apply_leave_flow()
            elif "exit" in command:
                speak("Good day")
                break
            else:
                speak("Sorry, I didn’t understand that. You can say book appointment, apply for leave, or exit.")
        else:
            speak("I didn't hear anything. Please say your command again.")
    return jsonify({"message": "Session ended."})

@app.route('/book-appointment', methods=['GET'])
def book_appointment():
    data = book_appointment_flow()
    return jsonify({"message": "Your appointment request is submitted successfully.", **data})

@app.route('/apply-leave', methods=['GET'])
def apply_leave():
    data = apply_leave_flow()
    return jsonify({"message": "Your leave application is submitted successfully.", **data})

@app.route('/all-appointments', methods=['GET'])
def all_appointments():
    all_data = list(appointments_collection.find({}, {'_id': 0}))
    return jsonify({"appointments": all_data})

if __name__ == '__main__':
    app.run(debug=True)
