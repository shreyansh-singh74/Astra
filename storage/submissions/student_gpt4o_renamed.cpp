#include <vector>
#include <cmath>
#include <algorithm>

// Renamed helper function
int getManhattanDistance(std::pair<int, int> a, std::pair<int, int> b) {
    return std::abs(a.first - b.first) + std::abs(a.second - b.second);
}

// Renamed main function and parameters
bool isPathFeasible(std::vector<std::pair<int, int>> points, std::vector<std::pair<int, int>> powerStations) {
    int chargeRemaining = 100; // Renamed variable
    
    for (size_t idx = 0; idx < points.size() - 1; ++idx) {
        chargeRemaining -= getManhattanDistance(points[idx], points[idx+1]);
        if (chargeRemaining <= 0) return false;
        
        // Renamed variable usage
        auto searchIt = std::find(powerStations.begin(), powerStations.end(), points[idx+1]);
        if (searchIt != powerStations.end()) {
            chargeRemaining = 100;
        }
    }
    return true;
}
