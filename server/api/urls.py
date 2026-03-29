from django.urls import path
from . import views

urlpatterns = [
    path('songs/', views.songs_list, name='songs_list'),
    path('sleeves/', views.sleeves_list, name='sleeves_list'),
    path('inventory/', views.inventory_list, name='inventory_list'),
    path('inventory/reroll/', views.reroll_inventory_song, name='reroll_inventory_song'),
    path('sleeves/<str:sleeve_id>/open', views.open_sleeve, name='open_sleeve'),
    path('auth/register/', views.auth_register, name='auth_register'),
    path('auth/login/', views.auth_login, name='auth_login'),
    path('auth/session/', views.auth_session, name='auth_session'),
    path('auth/logout/', views.auth_logout, name='auth_logout'),
    path('profiles/<str:username>/', views.profile_detail, name='profile_detail'),
    path('profiles/<str:username>/update/', views.profile_update, name='profile_update'),
    path('friends/', views.friends_overview, name='friends_overview'),
    path('friends/requests/', views.send_friend_request, name='send_friend_request'),
    path('friends/requests/<int:request_id>/accept/', views.accept_friend_request, name='accept_friend_request'),
    path('friends/requests/<int:request_id>/deny/', views.deny_friend_request, name='deny_friend_request'),
    path('market/listings/', views.market_listings, name='market_listings'),
    path('market/listings/create/', views.market_create_listing, name='market_create_listing'),
    path('market/listings/<int:listing_id>/buy/', views.market_buy_listing, name='market_buy_listing'),
]