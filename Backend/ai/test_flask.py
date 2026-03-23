#!/usr/bin/env python3
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/disease_prediction", methods=["POST"])
def disease_prediction():
    """Test endpoint"""
    try:
        data = request.json
        symptoms = data.get("symptoms", [])
        
        if not symptoms:
            return jsonify({"error": "No symptoms"}), 400
        
        return jsonify({
            "status": "success",
            "prediction": f"Based on {', '.join(symptoms)}, possible conditions include: Common Cold, Flu, Allergies",
            "symptoms_analyzed": symptoms
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("✅ Starting Flask test server on port 5001")
    app.run(host="localhost", port=5001, debug=True)
