from flask import Flask, request, jsonify, g
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
import google.generativeai as genai
import os
import jwt
import traceback
from functools import wraps
from dotenv import load_dotenv
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Comprehensive CORS configuration
CORS(app, 
     origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5000"],
     methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
     allow_headers=["Content-Type", "Authorization", "*"],
     supports_credentials=True,
     max_age=3600)

# Add additional CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

# MongoDB Connection
MONGO_URI = "mongodb+srv://sr8936050368_db_user:pJkxhL87xC5HnlQc@healthvault.9bllnrd.mongodb.net/healthvault"
try:
    # Set connection timeout to 5 seconds
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
    # Test connection immediately
    client.admin.command('ping')
    db = client["healthvault"]
    collection = db["healthrecords"]
    collection2=db["medicalleaves"]
    users_collection = db["users"]
    appointments_collection = db["appointments"]
    health_records_collection = db["healthrecords"]
    leave_collection = db["medicalleaves"]
    print("✅ MongoDB connected successfully")
except Exception as mongo_error:
    print(f"⚠️ MongoDB connection warning: {mongo_error}")
    print("⚠️ Using mock database mode - some endpoints may not work")
    # Continue anyway - set to None and handle in routes
    client = None
    db = None
    collection = None
    collection2 = None
    users_collection = None
    appointments_collection = None
    health_records_collection = None
    leave_collection = None


GEMINI_API_KEY = os.getenv("GEMINI_API")
JWT_SECRET = os.getenv("JWT_SECRET")  # Add this to your .env file

if not GEMINI_API_KEY:
    raise ValueError("❌ GEMINI_API key is missing! Set it in the .env file.")

if not JWT_SECRET:
    raise ValueError("❌ JWT_SECRET is missing! Set it in the .env file.")

# Configure Gemini AI
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")

# Helper function to fetch user names by ID
def get_user_name(user_id):
    user = users_collection.find_one({"_id": ObjectId(user_id)}, {"name": 1})
    return user["name"] if user else "Unknown"

# Auth middleware function with updated token structure
def auth_middleware(roles=[]):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            print("---- Auth Middleware Debug ----")
            print("All cookies:", request.cookies)
            token = request.cookies.get('jwt')
            print("JWT cookie present:", token is not None)
            
            if not token:
                # Also check Authorization header as fallback
                auth_header = request.headers.get('Authorization')
                if auth_header and auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
                    print("Using token from Authorization header")
                else:
                    print("No JWT token found in cookies or Authorization header")
                    return jsonify({"message": "Unauthorized"}), 401
                
            try:
                # Decode the JWT token - ensure proper options
                decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"require": ["exp"]})
                print(f"JWT decoded successfully. User ID: {decoded.get('id')}, Role: {decoded.get('role')}")

                # Store user in Flask's g object - note we're mapping 'id' to '_id'
                g.user = {
                    "_id": decoded.get('id'),  # Map 'id' from token to '_id' in g.user
                    "role": decoded.get('role')
                }
                
                # Check if user has required role
                if roles and g.user.get('role') not in roles:
                    print(f"Access denied. User role: {g.user.get('role')}, Required roles: {roles}")
                    return jsonify({"message": "Access Denied"}), 403
                    
                return f(*args, **kwargs)
                
            except jwt.ExpiredSignatureError:
                print("Token expired")
                return jsonify({"message": "Token expired"}), 401
            except jwt.InvalidTokenError as e:
                print(f"Invalid token: {str(e)}")
                return jsonify({"message": f"Invalid token: {str(e)}"}), 403
            except Exception as e:
                print(f"Error: {str(e)}")
                return jsonify({"message": f"Internal Server Error: {str(e)}"}), 500
                
        return decorated_function
    return decorator

# Helper function to convert MongoDB ObjectId to string
def convert_objectid(data):
    """Recursively converts ObjectId fields to strings in a dictionary or list"""
    if isinstance(data, list):
        return [convert_objectid(doc) for doc in data]
    if isinstance(data, dict):
        return {k: str(v) if isinstance(v, ObjectId) else v for k, v in data.items()}
    return data

# Debug endpoint to test authentication
@app.route("/auth-test", methods=["GET"])
@auth_middleware([])  # No role restriction for testing
def auth_test():
    """Simple endpoint to test if authentication works"""
    return jsonify({
        "message": "Authentication successful!",
        "user_id": g.user.get('_id'),
        "role": g.user.get('role')
    })

@app.route("/disease_prediction", methods=["POST"])
def disease_prediction():
    """Disease prediction endpoint - returns AI prediction based on symptoms"""
    try:
        data = request.json
        symptoms = data.get("symptoms", [])

        if not symptoms or not isinstance(symptoms, list):
            return jsonify({"error": "Symptoms must be a non-empty list"}), 400

        # Convert symptoms list to a formatted string
        symptoms_text = ", ".join(symptoms)

        # Create prompt for Gemini AI
        gemini_prompt = f"""You are a medical assistant AI. A patient is experiencing the following symptoms: {symptoms_text}.

Based on these symptoms, provide:
1. The most likely disease or condition
2. Explanation of why these symptoms match this condition
3. Recommended treatments and care
4. When to seek medical attention

Format your response clearly with sections. Be concise but informative.
Important: This is for informational purposes only - always recommend consulting a healthcare professional."""

        # Call Gemini AI to generate prediction
        print(f"🔍 Calling Gemini AI with symptoms: {symptoms_text}")
        response = model.generate_content(gemini_prompt)
        
        if response and response.text:
            final_prediction = response.text
            print(f"✅ AI Response generated successfully")
            return jsonify({
                "status": "success",
                "prediction": final_prediction,
                "symptoms_analyzed": symptoms
            }), 200
        else:
            print(f"⚠️ Empty response from Gemini AI")
            return jsonify({
                "error": "Could not generate prediction",
                "status": "error"
            }), 500

    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] /disease_prediction: {error_msg}")
        
        # Handle rate limiting
        if "429" in error_msg or "quota" in error_msg.lower():
            return jsonify({
                "error": "AI service is currently busy. Please try again in a few minutes.",
                "status": "rate_limited"
            }), 429
        
        return jsonify({
            "error": "Failed to process request",
            "status": "error",
            "details": error_msg
        }), 500


@app.route("/ask_question", methods=["POST"])
@auth_middleware(["student"])
def ask_question():
    try:
        data = request.json
        print("Received JSON:", data)

        user_question = data.get("question")
        if not user_question:
            return jsonify({"error": "Question is required"}), 400

        # Get student ID from JWT and validate
        student_id = g.user.get('_id')
        print(f"Using student ID from token: {student_id}")
        if not student_id:
            return jsonify({"error": "Invalid user ID in token"}), 400

        # Fetch student name
        student = users_collection.find_one({"_id": ObjectId(student_id)}, {"name": 1})
        student_name = student["name"] if student else "Unknown Patient"
        print(f"Student name: {student_name}")

        # Fetch medical records
        records = list(collection.find({"studentId": ObjectId(student_id)}))
        print(f"Medical records found: {len(records)}")

        if not records:
            return jsonify({"error": "No medical history found for this patient"}), 404

        enriched_records = []
        for record in records:
            doctor_name = "Unknown Doctor"
            doctor_id = record.get("doctorId")

            if doctor_id:
                try:
                    doctor = users_collection.find_one({"_id": ObjectId(doctor_id)}, {"name": 1})
                    if doctor and doctor.get("name"):
                        doctor_name = doctor["name"]
                    else:
                        # Fallback: check for externalDoctorName
                        external_name = record.get("externalDoctorName")
                        if external_name:
                            doctor_name = external_name
                except Exception as doc_error:
                    print(f"Error fetching doctor by ID {doctor_id}: {doc_error}")
                    external_name = record.get("externalDoctorName")
                    if external_name:
                        doctor_name = external_name
            else:
                # No doctorId, check for external name
                external_name = record.get("externalDoctorName")
                if external_name:
                    doctor_name = external_name

            enriched_records.append({
                "Date": str(record.get("createdAt", "Unknown")),
                "Diagnosis": record.get("diagnosis", "Not specified"),
                "Doctor": doctor_name,
                "Treatment": record.get("treatment", "Not specified"),
                "Prescription": record.get("prescription", "Not specified")
            })

        # Secure Gemini AI prompt
        gemini_prompt = f"""
        You are assisting {student_name} with their medical history.
        Do **not** include any database-related terms, IDs, or unnecessary details.

        Patient: {student_name}

        Medical History:
        {enriched_records}

        Answer the following question in a natural and professional manner:
        "{user_question}"
        """

        print("Prompt for Gemini:", gemini_prompt)

        # --- GENERATE RESPONSE USING GEMINI ---
        try:
            response = model.generate_content(gemini_prompt)
            final_answer = response.text if response and hasattr(response, 'text') else "I couldn't generate an answer."
        except Exception as ai_error:
            print("Gemini API error:", ai_error)
            traceback.print_exc()
            return jsonify({"error": "Failed to generate response using Gemini"}), 500

        return jsonify({"status": "success", "answer": final_answer})

    except Exception as e:
        print("Error in /ask_question:", e)
        traceback.print_exc()
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route("/leaverelated", methods=["POST"])
@auth_middleware(["student"])
def leave_related_question():
    try:
        data = request.json
        user_question = data.get("question")
        
        # Get student ID from the JWT token and convert to ObjectId
        student_id = g.user.get('_id')
        print(f"Using student ID from token: {student_id}")

        if not user_question:
            return jsonify({"error": "Question is required"}), 400

        # Fetch leave records - convert string ID to ObjectId
        records = list(collection2.find({"studentId": ObjectId(student_id)}))
        if not records:
            return jsonify({"error": "No leave history found for this student"}), 404

        formatted_records = convert_objectid(records)

        # Prepare Gemini AI prompt
        gemini_prompt = f"""
        The following is the student's leave record history:
        {formatted_records}
        
        Based on this data, answer the following question:
        "{user_question}"
        """

        # Generate response using Gemini AI
        response = model.generate_content(gemini_prompt)

        final_answer = response.text if response and response.text else "Gemini AI could not generate an answer."

        return jsonify({"status": "success", "answer": final_answer})

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

    

# ✅ AI-Powered Doctor Insights (Secure)
@app.route("/doctor_insights", methods=["POST"])
@auth_middleware(["doctor"])
def doctor_insights():
    try:
        data = request.json
        user_question = data.get("question")

        # Get doctor ID from the JWT token and convert to ObjectId
        doctor_id = g.user.get('_id')
        print(f"Using doctor ID from token: {doctor_id}")

        if not user_question:
            return jsonify({"error": "Question is required"}), 400

        # Fetch doctor details including available slots
        doctor = users_collection.find_one({"_id": ObjectId(doctor_id)}, {"name": 1, "availableSlots": 1})
        if not doctor:
            return jsonify({"error": "Doctor not found"}), 404
        
        doctor_name = doctor.get("name", "Unknown Doctor")
        available_slots = doctor.get("availableSlots", [])

        # Extract only non-booked slots
        free_slots = [slot["dateTime"] for slot in available_slots if not slot.get("isBooked", True)]

        # Fetch doctor's upcoming appointments
        appointments = list(appointments_collection.find({"doctorId": ObjectId(doctor_id)}))
        enriched_appointments = []
        for appointment in appointments:
            student_name = get_user_name(appointment["studentId"])
            
            # Handle the single slotDateTime field
            appointment_time = appointment.get("slotDateTime", "Unknown")
            
            enriched_appointments.append({
                "Patient": student_name,
                "DateTime": appointment_time,
                "Status": appointment.get("status", "Unknown")
            })

        # Fetch health records of treated patients
        health_records = list(health_records_collection.find({"doctorId": ObjectId(doctor_id)}))
        enriched_health_records = []
        for record in health_records:
            student_name = get_user_name(record["studentId"])
            
            # Try multiple potential date field names
            record_date = record.get("createdAt") or record.get("date") or record.get("dateTime") or record.get("timestamp") or "Unknown"
            
            enriched_health_records.append({
                "Patient": student_name,
                "Diagnosis": record.get("diagnosis", "Not specified"),
                "Treatment": record.get("treatment", "Not specified"),
                "Prescription": record.get("prescription", "Not specified"),
                "DateTime": record_date
            })

        # AI Prompt (Using consistent DateTime field names)
        gemini_prompt = f"""
        You are assisting Dr. {doctor_name} with patient records.

        Available Appointment Slots:
        {free_slots}

        Your Upcoming Appointments:
        {enriched_appointments}

        Your Past Treatments:
        {enriched_health_records}

        Answer the following question:
        "{user_question}"
        """

        # Add debugging to see what's being passed to the AI
        print(f"Sending prompt to Gemini AI:\n{gemini_prompt}")

        response = model.generate_content(gemini_prompt)
        final_answer = response.text if response and response.text else "I couldn't generate an answer."

        return jsonify({"status": "success", "answer": final_answer})

    except Exception as e:
        print(f"Doctor insights error: {str(e)}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


# Run Flask app
if __name__ == "__main__":
    app.run(host="localhost", port=5001, debug=True)
