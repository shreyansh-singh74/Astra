#include <vector>
#include <cmath>
#include <algorithm>

int calculateManhattan(std::pair<int, int> p1, std::pair<int, int> p2) {
    return std::abs(p1.first - p2.first) + std::abs(p1.second - p2.second);
}

bool canCompleteRoute(std::vector<std::pair<int, int>> route, std::vector<std::pair<int, int>> chargers) {
    int currentBattery = 100;
    
    for (size_t i = 0; i < route.size() - 1; ++i) {
        currentBattery -= calculateManhattan(route[i], route[i+1]);
        if (currentBattery <= 0) return false;
        
        // Check if current spot is a charger
        auto it = std::find(chargers.begin(), chargers.end(), route[i+1]);
        if (it != chargers.end()) {
            currentBattery = 100;
        }
    }
    return true;
}
