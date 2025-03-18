import pymongo
import numpy as np
from pymongo import MongoClient
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import sys
import json

# MongoDB connection
uri = "mongodb+srv://pratikkhodka137:Khodka@cluster0.3nkyf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
connection = MongoClient(uri)
db = connection.test

# Fetch data from MongoDB collections
collection1 = db.userwithcats
collection2 = db.reviews

userList = pd.DataFrame(list(collection1.find()))
ratings = pd.DataFrame(list(collection2.find()))

# Merge ratings with userList to get user details
ratings_with_userList = ratings.merge(userList, on="username")

# Pivot table for collaborative filtering
pt = ratings_with_userList.pivot_table(index='touristLocation', columns='username', values='rating', fill_value=0)
similarity_scores = cosine_similarity(pt)

# Compute popular places with a broader range
popular_places = ratings_with_userList.groupby('touristLocation').agg({
    'rating': ['mean', 'count'],  # Include count for reliability
    'img': 'first'
}).reset_index()
popular_places.columns = ['touristLocation', 'avg_rating', 'rating_count', 'img']
# Sort by avg_rating and rating_count for more reliable recommendations
popular_places = popular_places.sort_values(by=['avg_rating', 'rating_count'], ascending=False)

# Take a larger set to ensure diversity
popular_places_all = popular_places.head(20)  # Take top 20 for diversity

# Function to recommend places based on a tourist location
def recommend(touristLocation):
    try:
        if touristLocation not in pt.index:
            return []

        index = np.where(pt.index == touristLocation)[0][0]
        similar_items = sorted(list(enumerate(similarity_scores[index])), key=lambda x: x[1], reverse=True)[1:6]
        
        recommendations = []
        for i in similar_items:
            temp_df = ratings_with_userList[ratings_with_userList['touristLocation'] == pt.index[i[0]]]
            avg_rating = temp_df['rating'].mean()
            if pd.isna(avg_rating):
                continue
            recommendations.append({
                'touristLocation': temp_df['touristLocation'].iloc[0],
                'avg_rating': float(avg_rating),
                'img': temp_df['img'].iloc[0],
            })

        return recommendations
    except Exception as e:
        return [{"error": f"Error in recommendation function: {str(e)}"}]

# Function to recommend places based on user's email ID
def recommend_by_email(email):
    try:
        # Find the user by email
        user = userList[userList['email'] == email]
        if user.empty:
            return [{"error": f"User with email '{email}' not found."}]
        
        username = user['username'].iloc[0]
        
        # Get the places rated by this user
        user_ratings = ratings_with_userList[ratings_with_userList['username'] == username]
        if user_ratings.empty:
            # Fallback to popular places with diverse ratings
            return get_diverse_recommendations(popular_places_all)

        # Get top-rated places
        user_top_places = user_ratings.sort_values(by='rating', ascending=False)['touristLocation'].head(3).values
        
        # Get recommendations based on top-rated places
        recommendations = []
        for place in user_top_places:
            recs = recommend(place)
            if recs:
                recommendations.extend(recs)

        # Remove duplicates and sort by rating
        if recommendations:
            recommendations_df = pd.DataFrame(recommendations).drop_duplicates(subset='touristLocation')
            recommendations_df = recommendations_df.sort_values(by='avg_rating', ascending=False)
            return get_diverse_recommendations(recommendations_df)
        else:
            return get_diverse_recommendations(popular_places_all)

    except Exception as e:
        return [{"error": f"An error occurred for email '{email}': {str(e)}"}]

# Function to ensure diverse ratings and return 9 places
def get_diverse_recommendations(df):
    # Create a copy to avoid modifying the original DataFrame
    df = df.copy()
    
    # Round avg_rating to nearest integer for easier filtering
    df['rounded_rating'] = df['avg_rating'].round().astype(int)
    
    # Prioritize places with ratings 5, 4, and 3 to reach 9
    high_rated = df[df['rounded_rating'] == 5].head(4)  # Up to 4 places with rating ~5
    mid_rated = df[df['rounded_rating'] == 4].head(3)   # Up to 3 places with rating ~4
    low_rated = df[df['rounded_rating'] == 3].head(2)   # Up to 2 places with rating ~3
    
    # Combine and ensure we have 9 places
    combined = pd.concat([high_rated, mid_rated, low_rated]).drop_duplicates(subset='touristLocation')
    if len(combined) < 9:
        # Fill remaining slots with other places from the original df
        remaining = df[~df['touristLocation'].isin(combined['touristLocation'])].head(9 - len(combined))
        combined = pd.concat([combined, remaining])
    
    # Drop the temporary rounded_rating column and return as list of dictionaries
    result = combined.drop(columns=['rounded_rating', 'rating_count'], errors='ignore')
    return result[['touristLocation', 'avg_rating', 'img']].to_dict('records')

# Main execution
if __name__ == "__main__":
    if len(sys.argv) > 1:
        email_to_test = sys.argv[1]
        recommendations = recommend_by_email(email_to_test)
        
        # Ensure proper JSON output
        sys.stdout.write(json.dumps(recommendations))
    else:
        sys.stdout.write(json.dumps([{"error": "No email provided"}]))