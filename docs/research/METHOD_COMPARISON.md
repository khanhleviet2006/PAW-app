# Các giả định cần kiểm tra cho từng phiên

| Phương pháp | Mô hình và đầu vào | Quyết định cho hai cột di động |
|---|---|---|
| IDW | ẑ = Σ wᵢzᵢ / Σ wᵢ, wᵢ = dᵢ⁻ᵖ. Giá trị tại điểm trùng lấy trực tiếp. | Baseline theo mét. Chặn bán kính và số láng giềng. Không có phương sai mô hình. |
| Ordinary Kriging | γ̂(h) = Σ(zᵢ−zⱼ)²/(2Nₕ). Giải Γλ+μ1=γ₀, Σλ=1. ẑ=λᵀz, σ²=λᵀγ₀+μ. | Cần nhiều cặp ở nhiều khoảng cách. Thử spherical, exponential, Gaussian; loại fit kém và hệ suy biến. |
| Universal Kriging | Z(s)=f(s)ᵀβ+ε(s), ràng buộc Fᵀλ=f(s₀). | Trend sườn có thể phù hợp nhưng dễ nhầm với thời gian đo khi cột di chuyển. |
| Regression Kriging | fit m(X), sau đó ẑ=m(X₀)+OK(z−m). | Adapter nghiên cứu. Chỉ kích hoạt sau ablation theo fold với raster đồng hệ tọa độ và cùng thời điểm. |
| External drift | Universal kriging với f phụ thuộc raster ngoại sinh ở cả trạm và ô dự đoán. | Cần raster có ý nghĩa vật lý. NDVI hoặc độ cao phải được kiểm định riêng theo tầng đất. |
| TPS | Tối thiểu hóa sai số bình phương + λ tích phân độ cong bậc hai. | Đối chứng khi có đủ mẫu; có thể vượt miền vật lý tại biên. |
| RBF | Σaᵢφ(‖s−sᵢ‖)+trend. | Nhạy scale và regularization khi các điểm gần trùng. |
| Gaussian process | μ₀+k₀ᵀ(K+σ²I)⁻¹(y−μ). | Kernel và noise cần ước lượng tốt; cùng họ với kriging dưới giả định tương ứng. |
| Space-time | covariance C(h,u) của khoảng cách và độ trễ. | Cần nhiều đợt cùng vị trí, lịch mưa/tưới và validation theo thời gian. Hiện chỉ tính trong một session. |

Khi chưa có ground truth PAW, các ngưỡng vận hành là heuristic có thể cấu hình. Sai số dùng chọn mô hình là điểm CV nội bộ; báo cáo sai số nghiên cứu cần một tập vị trí/ngày nghiệm thu độc lập với quá trình chọn tham số.
