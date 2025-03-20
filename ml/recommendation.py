import sys
import json
import os
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from pymongo import MongoClient
from flask import Flask, request, jsonify

# MongoDB connection
uri = "mongodb+srv://pratikkhodka137:Khodka@cluster0.3nkyf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
connection = MongoClient(uri)
db = connection.test

# Fetch data from MongoDB
collection1 = db.userwithcats
collection2 = db.placeupdates

userList = pd.DataFrame(list(collection1.find()))
placeList = pd.DataFrame(list(collection2.find()))

# Preprocess user categories
userList['category'] = userList['category'].apply(lambda x: ", ".join(x) if isinstance(x, list) else str(x))
userList["category"] = userList["category"].str.split(", ")
userList = userList.explode("category")
userList["category"] = userList["category"].str.strip().str.lower()

# Preprocess place categories
placeList["category"] = placeList["category"].str.strip().str.lower()

# Merge dataframes
merged_df = userList.merge(placeList, on="category", how="inner")
merged_df = merged_df[['username', 'email', 'password', 'category', 'heading', 'image', 'para']]
merged_df["category"] = merged_df["category"].str.replace(" ", "", regex=True)

# Create tags
# merged_df['tags'] = merged_df['para'] + merged_df['category'] + merged_df['username'] + merged_df['email'] + merged_df['heading']
merged_df['tags'] =merged_df['username'] + merged_df['email'] + merged_df['heading']
new_dataframe = merged_df[['email', 'heading', 'image', 'tags', 'para']]
new_dataframe['tags'] = new_dataframe['tags'].apply(lambda x: x.lower())

# Vectorization
from sklearn.feature_extraction.text import CountVectorizer
cv = CountVectorizer(max_features=5000, stop_words='english')
vectors = cv.fit_transform(new_dataframe['tags']).toarray()

# Cosine similarity
similarity = cosine_similarity(vectors)

def recommend(email):
    # Check if the user exists in the DataFrame based on email
    if email not in new_dataframe['email'].values:
        return []

    # Get the user's tags
    user_data = new_dataframe[new_dataframe['email'] == email].iloc[0]
    user_tags = set()
    if isinstance(user_data['tags'], str):
        user_tags.update(user_data['tags'].split(","))

    # Filter places that match at least one of the user's tags
    filtered_df = new_dataframe[
        new_dataframe['tags'].apply(
            lambda x: any(tag in x.split(",") if isinstance(x, str) else False for tag in user_tags)
        )
    ]

    # If fewer than 6 matching places, return what we have
    if len(filtered_df) < 1:
        return []

    recommended_places = []
    seen_headings = set()
    place_count = 0

    # Sort places by similarity scores for this user's preferences
    for idx in filtered_df.index:
        distances = similarity[idx]
        places_list = sorted(list(enumerate(distances)), reverse=True, key=lambda x: x[1])[1:]
        
        # Add places in order of similarity until we get up to 6
        for i in places_list:
            place = new_dataframe.iloc[i[0]]
            if place['heading'] not in seen_headings:
                recommended_places.append({
                    'heading': place['heading'],
                    'image': place['image'],
                    'para': place['para'],
                })
                seen_headings.add(place['heading'])
                place_count += 1
                
                if place_count == 6:
                    return recommended_places

    return recommended_places[:6]  # Return whatever we found, up to 6

# Main execution: Get email from command-line argument
app = Flask(__name__)

@app.route('/', methods=['GET'])
def home():
    return jsonify({"message": "Welcome to the Recommendation Service! Use /recommend with POST or GET."}), 200

@app.route('/recommend', methods=['POST', 'GET'])
def recommend_endpoint():
    if request.method == 'POST':
        data = request.get_json()
        email = data.get('email') if data else None
    else:  # GET
        email = request.args.get('email')

    if not email:
        return jsonify({"error": "No email provided"}), 400

    try:
        recommendations = recommend(email)
        if not recommendations:
            return jsonify({"message": "No recommendations found for this email"}), 200
        return jsonify(recommendations), 200
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# Main execution for command-line or Flask
if __name__ == "__main__":
    if len(sys.argv) > 1:  # Command-line mode
        email = sys.argv[1]
        try:
            recommendations = recommend(email)
            print(json.dumps(recommendations))  # Output JSON to stdout
        except Exception as e:
            print(json.dumps({"error": f"Recommendation failed: {str(e)}"}), file=sys.stderr)
            sys.exit(1)
    else:  # Flask mode
        port = int(os.environ.get('PORT', 5000))
        app.run(host='0.0.0.0', port=port)